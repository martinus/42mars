;redcode-MC6
;name 3p-TAB3-A
;author Christian Schmidt
;assert 1

gate: jmp #0,<-3

for 5
dat 0, 0
rof

imp: mov.i #4,1

for 5
dat 0, 0
rof


ptr equ clear-3
clear: mov bmb,}ptr ;<-- must start here
mov bmb,}ptr
jmp -2
bmb: dat 7,0

for 5
dat 0, 0
rof

w0 equ clear
w1 equ gate
w2 equ imp

PSTATE EQU 278

think ldp.a #0 ,in
ldp.a #PSTATE ,table
mod.ba *in ,table
stp.b *table ,#PSTATE

; S L W T
table jmp }0 ,0441 ; 00 1 0 0
dat #w0 ,0154 ; 01 2 0 1
dat #w0 ,0163 ; 02 3 2 1
dat #w0 ,0092 ; 03 4 1 2
dat #w1 ,0102 ; 04 6 4 3
dat #w2 ,0446 ; 05 6 5 5
dat #w2 ,0362 ; 06 2 5 2
dat #w2 ,0362 ; 07 2 5 2
dat #w2 ,0362 ; 08 2 5 2

in dat 0,8
dat 0,7
dat 0,9

end think

