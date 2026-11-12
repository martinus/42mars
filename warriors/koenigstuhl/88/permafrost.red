;redcode 
;name Permafrost
;author John Metcalf 
;strategy paper/imp + paper/resin 
;assert CORESIZE==8000 

; qscan - 36 scans in 48 instructions 

qfirst equ (qp2+2*qstep) 
qdist equ qfirst+130 
qstep equ 260 

qi equ 7 
qr equ 7 

qbomb dat <qi/2-qi*qr, <qi*qr-qi/2 

qa equ qstep*16 
qb equ qstep*5+2 
qc equ qstep*10 
qd equ qstep*2 
qe equ qstep*1 

qscan cmp qdist+qc, qfirst+qc 
jmp qfast, <qa 
cmp qdist+qe+qd, qfirst+qe+qd 
qp1 jmp <qfast, <qc 
qp2 cmp qdist, qfirst 
qp3 jmp qskip, <qe 

cmp qdist+qb, qfirst+qb 
q1 djn qfast, #qp1 

cmp qdist+qd+qc, qfirst+qd+qc 
jmp qslow, <qfirst+qd+qc+4 
cmp qdist+qd+qb, qfirst+qd+qb 
x1 jmp qslow, <q1 
cmp qdist+qc+qc, qfirst+qc+qc 
q2 djn qslow, #qp2 
cmp qdist+qd, qfirst+qd 
jmp qslow, <qfast 
cmp qdist+qa, qfirst+qa 
jmp q1, <q1 

cmp qdist+qa+qd, qfirst+qa+qd 
jmp x1, <q1 
cmp qdist+qc+qb, qfirst+qc+qb 
jmp q2, <q1 
cmp qdist+qe+qd+qc,qfirst+qe+qd+qc 
jmp qslower, <qfirst+qe+qd+qc+4 
cmp qdist+qe+qd+qb,qfirst+qe+qd+qb 
jmp qslower, <q1 
cmp qdist+qe+qc+qc,qfirst+qe+qc+qc 
jmp qslower, <q2 
cmp qdist+qd+qd+qc,qfirst+qd+qd+qc 
q3 djn qslower, #qp3 
cmp qdist+qe+qc, qfirst+qe+qc 
jmp <qfast, <q2 
cmp qdist+qd+qd, qfirst+qd+qd 
jmp <qfast, <q3 
cmp qdist+qd+qd+qb,qfirst+qd+qd+qb 
slt <q3, <q1 

jmz warr, qdist+qe+qd+qc+10 

qslower add @q3, @qslow 
qslow add @q2, qkil 
qfast add @q1, @qslow 

qskip cmp <qdist+qstep+50, @qkil 
jmp qloop, <1234 

add #qdist-qfirst, qkil 
qloop mov qbomb, @qkil 
qkil mov <qfirst+qstep+50, <qfirst 
sub #qi, @qloop 
djn qloop, #qr+2 

warr spl 1, <2000 
spl 1, <3000 
spl 1, <4000 
mov <resin+4, <rboot 
mov <resin+4, <iboot 
iboot spl @0, idist 
rboot jmp @0, rdist 

idist equ 6692 ; 1000 
rdist equ 5188 ; 635 
pstepa equ 848 ; 4533 
pstepb equ 1389 ; 6007 
pstepc equ 1833 ; 5278 
pstepd equ 4050 ; 7467 
dpos equ 2180 ; 7875 
rpos equ 7452 ; 3524 
istep equ 2667 
proc equ 8 

; paper with vortex launch similar to Evil Spirit 

mov <proc, <papera 
papera spl @0, pstepa 
mov <proc, <paperb 
paperb spl @0, pstepb 
spl 0, <-125 
add #istep, launch 
launch jmp @0, imp-istep*proc 
imp mov 0, istep 

; paper with resin (Gymnosperm Trickery style clear) 

mov <proc, <paperc 
paperc spl @0, pstepc 
mov <proc, <paperd 
paperd spl @0, pstepd 
resin spl 0, <resin+dpos 
mov 1, <1 
mov <0, <rpos 
djn resin, <resin+dpos 

end qscan

