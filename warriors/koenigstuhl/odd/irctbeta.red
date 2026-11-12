;redcode
;name Irct Beta
;author Miz
;assert 1
mov.i imp, imp+400
spl imp+400
spl imp
mov.i -5, <400
mov.i <-10, <1
jmp -2, -10
imp: mov.i #0, 401
