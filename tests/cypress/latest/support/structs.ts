export type Cluster = {
    className: string
    classNamespace?: string
    metadata: {
        namespace?: string
        clusterName: string
        k8sVersion: string
        autoImportCluster?: boolean
    }
    clusterNetwork: {
        serviceCIDR?: string[]
        podCIDR?: string[]
        serviceDomain?: string
        apiServerPort?: string
    }
    controlPlane?: {
        host?: string
        port?: string
        replicas?: string
    }
    workers: {
        name: string
        class: string
        replicas: string
    }[]
    variables: {
        name: string
        value: string
        type: 'string' | 'dropdown' | 'codeMirror'
    }[]

    labels?: Record<string, string>
    annotations?: Record<string, string>
}

export type Question = {
    menuEntry: string
    checkbox?: string
    inputBoxTitle: string
    inputBoxValue: string
}
