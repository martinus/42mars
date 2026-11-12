;redcode-tiny
;assert CORESIZE == 800
;name rdrc: Mollusk Promenade
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   An evolving population playing KOTH.
;strategy -   Configured for the Tiny hill.
;scanner w/ imps. 5/11/18
mov.i  {    92, $   200
mov.i  {  -361, $   267
mov.i  {   288, $  -232
mov.i  {   187, >   112
mov.i  {  -191, $    56
spl.ba #   -56, <   368
sne.i  $    40, $   128
add.f  $    -1, $    -1
mov.i  <   -97, {   400
mov.i  }    -3, {    -3
mov.i  {    -1, <    -2
mov.i  >    -9, <    -5
mov.i  {    -1, <  -155
spl.ba #  -320, >   257
mov.i  $    -2, {   -52
mov.i  <    -3, {   241
djn.i  $   -67, #    50
mov.i  {     0, $   374
spl.ba #     2, <   345
spl.ba #     0, >   191
end   0

