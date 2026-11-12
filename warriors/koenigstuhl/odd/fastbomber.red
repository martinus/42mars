;redcode
;name Fast bomber
;author David Houston
;assert 1

add #4 * 23, bomb
mov bomb, @bomb
jmp -2
bomb dat 0, 4 * 23
