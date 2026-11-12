;redcode-nano
;assert CORESIZE == 80
;name rdrc: Slug Stampede
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   An evolving population playing KOTH.
spl.i  #   -30, >    21
mov.i  *   -12, {     0
mov.i  >   -29, {    -2
djn.x  $    -2, $    -3
spl.i  <    -1, #    35
end   0

