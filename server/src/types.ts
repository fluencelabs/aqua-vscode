import type {
    AbilityType,
    ArrayType,
    CanonStreamType,
    OptionType,
    ServiceType,
    StreamMapType,
    StreamType,
    StructType,
    Type,
} from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';

function collectionToString(
    type: ArrayType | StreamType | CanonStreamType | StreamMapType | OptionType,
    depth: number,
) {
    const elementType = typeToStringInner(type.element, depth);
    let prefix: string;
    switch (type.tag) {
        case 'array':
            prefix = '[]';
            break;
        case 'stream':
            prefix = '*';
            break;
        case 'canon':
            prefix = '#';
            break;
        case 'streammap':
            prefix = '%';
            break;
        case 'option':
            prefix = '?';
            break;
        default:
            const _exhaustiveCheck: never = type;
            return _exhaustiveCheck;
    }
    return prefix + elementType;
}

function namedToString(type: AbilityType | StructType | ServiceType, depth: number) {
    let fieldsStr = Object.entries(type.fields).map(function ([name, fieldType]) {
        const fieldTypeStr = typeToStringInner(fieldType, depth + 1);
        return `${name}: ${fieldTypeStr}`;
    });
    return `${type.name}(${fieldsStr.join(', ')})`;
}

function typeToStringInner(type: Type, depth: number): string {
    switch (type.tag) {
        case 'nil':
            return '∅';
        case 'array':
        case 'option':
        case 'stream':
        case 'streammap':
        case 'canon':
            return collectionToString(type, depth);
        case 'struct':
        case 'ability':
        case 'service':
            if (depth >= 1) {
                return type.name;
            }
            return namedToString(type, depth);
        case 'labeled':
            const args = Object.entries(type.args).map(function ([name, argType]) {
                const fieldTypeStr = typeToStringInner(argType, depth + 1);
                return `${name}: ${fieldTypeStr}`;
            });
            return args.join(', ');
        case 'unlabeled':
            return type.types.map((t) => typeToStringInner(t, depth + 1)).join(', ');
        case 'arrow':
            const domainStr = typeToStringInner(type.domain, depth + 1);
            const codomainStr = typeToStringInner(type.codomain, depth + 1);
            return `fn (${domainStr}) -> ${codomainStr}`;
        case 'top':
            return 'top';
        case 'bottom':
            return 'bottom';
        case 'scalar':
            return type.name;
        default:
            const _exhaustiveCheck: never = type;
            return _exhaustiveCheck;
    }
}

export function typeToString(type: Type): string {
    return typeToStringInner(type, 0);
}
