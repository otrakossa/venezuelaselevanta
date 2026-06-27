<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## ⚠️ BASE DE DATOS DE PRODUCCIÓN

Producción = proyecto Supabase **NUEVO** `advebubtfjgxwpjxprok` (`https://advebubtfjgxwpjxprok.supabase.co`).

El proyecto VIEJO `evcgvbycvgueoelvfbna` está congelado y NO refleja producción.

Las herramientas `supabase--*` y las variables `PG*` del sandbox apuntan al VIEJO. Para datos reales usar siempre:

```bash
psql "$NEW_SUPABASE_DB_URL" -c "..."
# o REST:
curl -H "apikey: $NEW_SUPABASE_SERVICE_KEY" "$NEW_SUPABASE_URL/rest/v1/..."
```

Ver `CLAUDE.md` para reglas completas.

