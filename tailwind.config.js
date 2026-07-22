/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
		"./index.html",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			screens: {
				xs: '480px',
			},
			// ── Design system MOBILE (cf. docs/MOBILE.md) ──
			// Échelle fermée à 6 crans, adossée aux tokens CSS de src/index.css.
			// Utiliser `text-display/title/headline/body/label/caption` sur mobile
			// plutôt que `text-[Npx]` : c'est ce qui garantit la cohérence.
			fontSize: {
				display: ['var(--t-display)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
				title: ['var(--t-title)', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
				headline: ['var(--t-headline)', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
				body: ['var(--t-body)', { lineHeight: '1.45' }],
				label: ['var(--t-label)', { lineHeight: '1.35' }],
				caption: ['var(--t-caption)', { lineHeight: '1.3' }],
			},
			spacing: {
				gutter: 'var(--gutter)',
				row: 'var(--gap-row)',
				section: 'var(--gap-section)',
				touch: 'var(--touch-min)',
			},
			minHeight: {
				touch: 'var(--touch-min)',
			},
			minWidth: {
				touch: 'var(--touch-min)',
			},
			borderColor: {
				DEFAULT: 'hsl(var(--border))',
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				'accent-solid': 'hsl(var(--accent-solid))',
				'border-strong': 'rgb(var(--color-border-strong))',
				'border-muted': 'rgb(var(--color-border-muted))',
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				// Rayons du design system mobile
				row: 'var(--r-row)',
				card: 'var(--r-card)',
				sheet: 'var(--r-sheet)'
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
			},
			boxShadow: {
				'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
				DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
				'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
				'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'shake': {
					'0%, 100%': { transform: 'translateX(0)' },
					'15%, 55%': { transform: 'translateX(-6px)' },
					'35%, 75%': { transform: 'translateX(6px)' },
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'shake': 'shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97)'
			}
		}
	},
	plugins: [
		require("tailwindcss-animate"),
	],
};
