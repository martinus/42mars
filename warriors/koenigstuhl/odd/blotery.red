;redcode-DS
;name Blottery
;author inversed
;strategy Paper/dclear
;assert 1

ofs0 equ (529+2025-1500+459-250)
ofs1 equ (4801+468-1500+51-250)
ofs2 equ (3442+2774-1500+360-250)
zofs equ (6829+2902-1500+442-250)
dist equ (7549+907-1500+76-250)
safe equ 12

x0 equ silk0
org boot

silk0 spl @0, <ofs0
mov }silk0, >silk0
mov }silk0, >silk0
silk1 spl @0, <ofs1
mov }silk1, >silk1
mov {silk1, <silk2
silk2 jmp @0, >ofs2

boot spl 1 , 0
spl 1 , 0
mov < bptr , { bptr
mov < bptr , { bptr
bptr spl * x0 + dist + 8 , cptr + 8
jmp silk0 , 0

cptr dat clear, zofs
dat 0, 0
clear spl #0, >cptr
spl #0, >cptr
mov bomb, >cptr
dj djn.f -1, >cptr
bomb dat 0, safe

