;redcode
;name Atomic Bomberman
;author Jakub Kozisek
;strategy ?!?
;assert 1

org launch

bmb dat {1, {-1
bomb1 mov.i bmb, last+4
mov.i bmb, last+6
mov.i bmb, last+2
mov.i bmb, last+8
launch spl bomb1, {last+1
bomb2 mov.i bmb, last+5
mov.i bmb, last+7
mov.i bmb, last+3
last mov.i bmb, last+9
