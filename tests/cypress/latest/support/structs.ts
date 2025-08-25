export type ClusterClassVariablesInput = {
    name: string
    value: string
    type: 'string' | 'dropdown' | 'codeMirror'
}

export type Question = {
    menuEntry: string
    checkbox?: string
    inputBoxTitle: string
    inputBoxValue: string
}

export type GeneralClusterInformation = {
    namespace?: string
    clusterName: string
    k8sVersion: string
    autoImportCluster?: boolean
}

export type ControlPlaneData = {
    host?: string
    port?: string
    replicas?: string
}

export type NetworkingInformation = {
    serviceCIDR?: string[]
    podCIDR?: string[]
    serviceDomain?: string
    apiServerPort?: string
}

export type WorkerInformation = {
    name: string
    class: string
    replicas: string
}
