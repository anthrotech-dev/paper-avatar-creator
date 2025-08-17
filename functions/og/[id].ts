export const onRequest: PagesFunction = async (context) => {
    const url = new URL(context.request.url)
    const originalPath = '' + url.pathname.replace('/og', '')

    const { id } = context.params

    const responseBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title></title>
    <meta property="og:title" content="oekaki avatar">
    <meta property="og:description" content="oekaki avatarは、web上でおえかきするだけで簡単にアバターが作成できるサービスです。">
    <meta property="og:image" content="https://pub-01b22329d1ae4699af72f1db7103a0ab.r2.dev/uploads/${id}/thumbnail">
    <meta property="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#0476d9" />
    <link rel="canonical" href="${originalPath}">
    <script>
        window.location.href = "${originalPath}"
    </script>
  </head>
</html>`

    const response = new Response(responseBody, {
        headers: {
            'Content-Type': 'text/html'
        }
    })

    return response
}
