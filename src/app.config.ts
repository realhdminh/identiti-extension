import { defineAppConfig } from "#imports"

// Define types for your config
declare module "wxt/utils/define-app-config" {
  export interface WxtAppConfig {}
}

export default defineAppConfig({})