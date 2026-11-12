;redcode-94
;assert 1
;name round1-warr
;author Miz
const equ 20
up add.f      3,   1
scan sne.i  100+const, 100+const-10
   djn.f     -2, <7500
   spl   #const, #const
   mov.i     @2, >scan
   mov.i     @1, >scan
   djn.f     -2, {2
   dat     2500,  7
   spl   #-2500,  8
dat $0, $0
dat $0, $0
dat $0, $0
state equ 3995
start: ldp.a #0, result
ldp.ba 2, state2
mod.ba *result, state2
stp.b *state, state

state2: jmp }0, 288
jmp scan, 288
jmp scan, 72
jmp paper, 66
jmp paper, 298
jmp stone, 68
jmp stone, 252
result: dat 0, 7
dat 0, 8
dat 0, 9
for 30
dat $0, $0
rof
paper:
spl 1
spl 1
spl 1
spl @0, 3781
mov }-1, >-1
spl @0, 2456
mov }-1, >-1
mov b, <5341
mov {-3, <1
jmz.a @0, 1234
b: dat <1, {1

for 30
dat $0, $0
rof
stone:
sstep equ 3044
mov <j, 1110
mov <j, {j
mov <j, {j
mov <j, {j
mov <j, {j
j jmp 1100, 6
s: spl #0
mov 10, >sstep
mov 9, @-1
add.ab #sstep, @-1
jmp -3
dat 1, 25
for 40
dat $0, $0
rof
end start

