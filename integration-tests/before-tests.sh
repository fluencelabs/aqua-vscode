#!/usr/bin/env bash

set -ex

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "$SCRIPT_DIR/test-workspace"

# Install deps for npm package
npm i -C npmPackage/

# Prepare fluence project
fluence init -t minimal fluenceProject --no-input
cd fluenceProject
fluence dep i