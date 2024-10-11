#!/usr/bin/env node

import { RegistryInitializer } from "./RegistryInitializer";

const registryInitializer = new RegistryInitializer();
registryInitializer.initRegistry();

export { RegistryInitializer };