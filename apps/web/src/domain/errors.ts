// The transport error is part of the model's public surface: services throw it,
// and viewmodels classify it (4xx user error vs 5xx service error) without
// reaching into the infrastructure layer.
export { ApiError } from "@/infrastructure/http/apiClient";
