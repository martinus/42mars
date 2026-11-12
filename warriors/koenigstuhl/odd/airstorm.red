;redcode-94
;name airstorm
;author David Houston <hurkyl@msn.com>
;assert CORESIZE % 20 == 0

offsetA equ -17
offsetB equ -9
stepA equ stepB
stepB equ -13 * 43
frame equ 20

adj equ frame * offsetA * 4

org bag

bag: spl 1
mov -1, 0
spl 1
jmp >0, stone - 1

bomb: dat 0, 12 + 20 * offsetB
wipe: dat 0, 10
dat 0, 10
nop 0
stone: add.f inc, ptr
mov bomb, *ptr
mov }bomb, @ptr
ptr: mov bomb + adj, @bomb - 6 + frame * offsetA + adj
hit: jmz.a stone, {bomb
inc: spl #frame * stepA, <frame * stepB
mov wipe + 1, >wipe
jmp -1
