import { http } from './client'
import type { SignedUrl } from './types'

/**
 * Materials (API.md §10). The console only opens uploaded files: uploading is the teachers', in
 * the mobile app (D-050), and lesson materials come with `GET /lessons/{id}`. No query keys and no
 * invalidation: a download URL is fetched on click and never cached, since it expires (a video's
 * after 6 hours, any other file's after 15 minutes).
 */
export const materialsApi = {
  downloadUrl: (id: string) => http.get<SignedUrl>(`/materials/${id}/download-url`),
}
