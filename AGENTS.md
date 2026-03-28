## Learned User Preferences

- Las respuestas al usuario deben estar en español.
- Al cerrar una feature suele pedir dejar specs/documentación al día y el árbol listo para commit.

## Learned Workspace Facts

- En dispositivo físico la app no puede usar `localhost` del Mac como URL del backend; hace falta IP de la LAN, túnel o host desplegado.
- Los IDs de páginas y bases de Notion no se infieren solo con `NOTION_API_KEY`; cada recurso necesita su variable de entorno explícita.
- En datos externos puede aparecer el typo **estafania** para la usuaria; conviene normalizar a **estefania** al mapear a `User`.
