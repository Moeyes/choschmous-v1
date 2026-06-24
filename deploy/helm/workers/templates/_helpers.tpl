{{/* CHOS-205: common template helpers for the workers chart. */}}

{{- define "moeys-workers.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "moeys-workers.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "moeys-workers.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "moeys-workers.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "moeys-workers.labels" -}}
helm.sh/chart: {{ include "moeys-workers.chart" . }}
app.kubernetes.io/part-of: moeys
app.kubernetes.io/component: workers
moeys.gov.kh/environment: {{ .Values.environment }}
{{ include "moeys-workers.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "moeys-workers.selectorLabels" -}}
app.kubernetes.io/name: {{ include "moeys-workers.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "moeys-workers.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "moeys-workers.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}
