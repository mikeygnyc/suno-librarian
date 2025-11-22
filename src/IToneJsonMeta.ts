export interface IToneJsonMeta {
  meta: IMeta
}

export interface IMeta {
  artist: string
  recordingDate: string
  title: string
  additionalFields: IAdditionalFields
}


export interface IAdditionalFields {
  description:string
  contact:string
  favorite:boolean
  ai_model:string
  suno_id:string
  suno_tags?:string
  suno_weirdness:string
  suno_style_strength:string
  suno_audio_strength:string
  comments:string
  remix_parent_id?:string|undefined
  lyrics?: string|undefined
}
