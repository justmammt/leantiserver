# Usa un'immagine Node.js base
FROM node:20

# Imposta la directory di lavoro
WORKDIR /app

# Copia il package.json e package-lock.json (se presente)
COPY package*.json ./

# Installa le dipendenze
RUN npm install

# Copia il resto del codice sorgente
COPY . .

# Espone la porta su cui l'applicazione ascolta (es. 8080)
EXPOSE 5678

# Comando per avviare l'applicazione
CMD ["npm", "start"]