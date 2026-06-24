{{/* CHOS-205: common template helpers for the api chart. */}}

{{- define "moeys-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "moeys-api.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "moeys-api.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "moeys-api.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "moeys-api.labels" -}}
helm.sh/chart: {{ include "moeys-api.chart" . }}
app.kubernetes.io/part-of: moeys
app.kubernetes.io/component: api
moeys.gov.kh/environment: {{ .Values.environment }}
{{ include "moeys-api.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "moeys-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "moeys-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "moeys-api.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "moeys-api.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}
