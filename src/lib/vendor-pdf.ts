// Point d'entrée de jsPDF : importé par `import()` au seul clic sur « Exporter en PDF »
// du rapport d'activité. Le nom du fichier donne son nom au chunk (`vendor-pdf`),
// que `check:bundle` plafonne ; une règle `manualChunks` le préchargeait dès l'entrée.
export { jsPDF } from 'jspdf';
