# Purse

A basic styling solution for web apps with an emphasis on simplicity and purity. The goal is to build a CSS-in-JS version of Tailwind's classname composition model.

```tsx
// Define styles outside your components
 const truncate = style({
	overflow: "hidden",
	lineClamp: 1,
	textOverflow: "ellipsis",
})

// Compose styles together
const actionButton = style(
  truncate,
  text[14],
  fonts.interface,
  border[1]
)

// Use pseudo or other complex selectors
const button = style({
  "&:disabled": {
		backgroundColor: indigo.indigo8,
	},
	"&:hover[disabled=false]": {
		backgroundColor: indigo.indigo10,
	},
})

// Use styles in your components dynamically
const buttonClassName = useStyles(props.quiet ? quietButtonStyles : buttonStyles)

// Can also use CSS properties directly
const blueTextClassName = useStyles({
  backgroundColor: "blue",
})
```

## Usage

Wrap your app in `PurseProvider`:

```tsx
<PurseProvider>
  <App/>
</PurseProvider>
```

That's all! No build step.
