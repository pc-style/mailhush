# Build Instructions for MailHush (Plasmo Framework)

## 1. Operating System and Build Environment Requirements
- **OS**: macOS, Linux, or Windows (WSL recommended)
- **Runtime**: Bun v1.2.x or higher (Node.js/npm is not used for this project)

## 2. Required Program Installation
To install Bun, please follow the official instructions at https://bun.sh:
```bash
curl -fsSL https://bun.sh/install | bash
```

## 3. Step-by-Step Build Instructions
To create an exact copy of the add-on code from the provided source:
1. Extract the uploaded source code archive and open a terminal in the root directory.
2. Run the command to install all dependencies:
   ```bash
   bun install
   ```
3. Run the build script to generate the extension bundle:
   ```bash
   bun run package:firefox
   ```

## 4. Build Output Location
The final extension package will be generated inside the `build` directory as a zip file named `firefox-mv2-prod.zip` and as an unpacked folder `firefox-mv2-prod`.

---

### Regarding `innerHTML` Warnings:
The validation warnings regarding "Unsafe assignment to innerHTML" are false positives originating from the Preact / React-DOM internals (which we use via the Plasmo framework). We do not use `innerHTML` for any user-facing data rendering.
