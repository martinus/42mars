;recode-weird
;name Miniwire
;author Miz
;strategy Small version of Mono
;strategy For Irc Miniround
;assert 1

n equ 5
const equ 24

up add.f      3,   1
sc sne.i   7+350, 0+350
   djn.f     -2, <-50
   spl   #const, #const
   mov.i     @1, >sc
   djn.f     -2, {2
   dat      -20,  7
   spl    #-500,  8

for 8
spl #n*356,>n*653
spl }3653+n,@3566-n
spl >253*n,3656+n
spl #35*n, *n*355
rof
boot mov <src, <dst
for 7
     mov <src, <dst
rof
src spl @dst, up+8
dst dat #1, -300+8
end boot
