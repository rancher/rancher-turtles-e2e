export type ClusterClassVariablesInput = {
    name: string
    value: string
    type: 'string' | 'dropdown'
}

export type Question = {
    menuEntry: string
    checkbox?: string
    inputBoxTitle: string
    inputBoxValue: string
}
