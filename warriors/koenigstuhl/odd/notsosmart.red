;redcode
;name Not so smart
;author John Morahan
;strategy random switcher
;assert 1

org go

gate: jmp #0,<-3

imp: mov.i #4,1

N for 5
dat 0,0
rof

ptr equ clear-3
clear: mov bmb,}ptr ;<-- must start here
mov bmb,}ptr
jmp -2
bmb: dat 7,0

go ldp.ab #0, #0 ; L/W/T
rnd ldp.ab #1, #0 ; random seed
mul.ab #621, rnd
add.ab #1, rnd
stp.b rnd, #1

mod.ab #3, rnd
mov.ba rnd, 1
jmp @0, imp
dat 0, clear
dat 0, gate

end