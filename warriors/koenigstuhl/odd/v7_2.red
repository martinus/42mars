;redcode
;assert CORESIZE == 8000
;name v7_2
;author Dave Hillis
;strat -   Created using RedRace.c.
;strat -   An evolving population playing KOTH.
;strat -   For KOFACOTO rnd 2.
add    $     0, $ -2744
spl    $     0, #     1
add    @     4, <    -2
mov    @    12, <    -3
djn    $    -1, @    -2
mov    $    -3, <    -4
mov    @     8, $    -4
spl    @    -1, <    -4
end   0 
