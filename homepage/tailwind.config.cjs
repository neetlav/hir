module.exports = {
      theme: {
        extend: {
          colors: {
            hir: {
              navy: '#14243D',
              blue: '#1769B3',
              pink: '#B51C70',
              magenta: '#F53293',
              bg: '#F8F9FC',
              border: '#E1E6EF',
              borderSubtle: '#EDF1F7',
              muted: '#647188',
              body: '#34445D',
              lavender: '#F4EEFB',
              paleBlue: '#EBF4FD',
              blush: '#FDF2F7',
            }
          },
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            wordmark: ['"Archivo"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          }
        }
      }
    };
module.exports.content = [require('node:path').join(__dirname, 'public/index.html')];
