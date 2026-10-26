import { http } from './client'
import type {
  CreateMaterialRequest,
  CreateUploadRequest,
  Material,
  MaterialUpload,
  SignedUrl,
} from './types'

/**
 * Materials (API.md §10). The admin console only opens uploaded files (D-050); the teacher
 * workspace also attaches links and uploads files the way the mobile app does (D-052): a pending
 * material from `createUploadUrl`, the bytes `PUT` straight to the storage, then `complete`.
 * Materials have no query keys of their own: a lesson's come with `lessonKeys.detail(id)` and a
 * course's under `courseKeys.materials(courseId)`, which every write invalidates. A download URL
 * is fetched on click and never cached, since it expires (a video's after 6 hours, any other
 * file's after 15 minutes).
 */
export const materialsApi = {
  downloadUrl: (id: string) => http.get<SignedUrl>(`/materials/${id}/download-url`),
  createLink: (body: CreateMaterialRequest) => http.post<Material>('/materials', body),
  /** A pending material with a 30-minute signed `PUT` URL; `501` while no storage is configured. */
  createUploadUrl: (body: CreateUploadRequest) =>
    http.post<MaterialUpload>('/materials/upload-url', body),
  /** The file is in storage: checks it and makes the material visible (`409 UPLOAD_INCOMPLETE` / `UPLOAD_REJECTED`). */
  complete: (id: string) => http.post<Material>(`/materials/${id}/complete`),
  /** Also cancels a pending upload. */
  remove: (id: string) => http.delete(`/materials/${id}`),
}
