{{/* CHOS-205: common template helpers for the bff chart. */}}

{{- define "moeys-bff.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "moeys-bff.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "moeys-bff.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "moeys-bff.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "moeys-bff.labels" -}}
helm.sh/chart: {{ include "moeys-bff.chart" . }}
app.kubernetes.io/part-of: moeys
app.kubernetes.io/component: bff
moeys.gov.kh/environment: {{ .Values.environment }}
{{ include "moeys-bff.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "moeys-bff.selectorLabels" -}}
app.kubernetes.io/name: {{ include "moeys-bff.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "moeys-bff.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "moeys-bff.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}
