;redcode-odd
;name Claw 2
;author Fizmo
;assert 1
;strategy scanner

STEP equ 2987;5515;
DIST equ 12
A equ (pt+(STEP*10))
ISTEP equ (8001/21)
LEN equ 8;(DIST/2)

start sub c, pt
pt cmp A, A+DIST
slt.ab #40, pt
cnt djn -3, #1700;1500
len mov #LEN, #0
mov pt, pt-3
mov glue, }pt-3
mov glue, >pt-3
djn -2, len
jmn.b cnt, cnt
add.a #ISTEP+1,cpt
mov @-1, {cpt
jmp -2
cpt spl #1, #4
c dat -STEP, -STEP
glue spl -1

for 42
dat 0, 0
rof


org qGo

qf equ qKil
qs equ 200
qd equ 4000
qi equ 7
qr equ 8

qBmb dat {qi*qr-10, {1
qGo seq qd+qf+qs, qf+qs
jmp qSki, {qd+qf+qs+qi+2
sne qd+qf+5*qs, qf+5*qs
seq qf+4*qs, {qTab
jmp qFas, }qTab
sne qd+qf+8*qs, qf+8*qs
seq qf+7*qs, {qTab-1
jmp qFas, {qFas
sne qd+qf+10*qs, qf+10*qs
seq qf+9*qs, {qTab+1
jmp qFas, }qFas
seq qd+qf+2*qs, qf+2*qs
jmp qFas, {qTab
seq qd+qf+6*qs, qf+6*qs
djn.a qFas, {qFas
seq qd+qf+3*qs, qf+3*qs
jmp qFas, {qd+qf+3*qs+qi+2
sne qd+qf+14*qs, qf+14*qs
seq qf+13*qs, <qTab
jmp qSlo, >qTab
sne qd+qf+17*qs, qf+17*qs
seq qf+16*qs, <qTab-1
jmp qSlo, {qSlo
seq qd+qf+11*qs, qf+11*qs
jmp qSlo, <qTab
seq qd+qf+15*qs, qf+15*qs
djn.b qSlo, {qSlo
sne qd+qf+12*qs, qf+12*qs
jmz start, qd+qf+12*qs-qi
qSlo mov.ba qTab, qTab
qFas mul.ab qTab, qKil
qSki sne qBmb-1, @qKil
add #qd, qKil
qLoo mov.i qBmb, @qKil
qKil mov.i qBmb, *qs
sub.ab #qi, qKil
djn qLoo, #qr
jmp start, <-4000
dat 5408, 7217
qTab dat 4804, 6613
dSrc dat 5810, qBmb-5

end
