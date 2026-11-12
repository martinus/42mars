;redcode-94x
;name Random switcher
;author David Houston
;assert CORESIZE == 8000

LCG equ 47
A equ 321
B equ 251


; Load LCG value
pbrain
value ldp.ab #LCG, #0
mul.ab #A, value
add.ab #B, value
stp.b value, #LCG
mod.ab #41, value
slt.ab #11, value
jmp imp
slt.ab #25, value
jmp cc
jmp wimp

for 10
dat 0, 0
rof

imp mov.i #4, 1

for 10
dat 0, 0
rof

cc mov bomb, }cc-3
mov bomb, }cc-3
jmp -2
bomb dat 7, 0

for 10
dat 0, 0
rof

wimp jmp #0, <-3

end