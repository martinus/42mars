;redcode-icws
;name A.I.P. (T)
;author Christian Schmidt
;strategy anti-imp paper
;assert 1
;optimax pap

aaa    equ 7590
bbb    equ 792
ccc    equ 4449
ddd    equ 7824
eee    equ 2994
length equ 9

;------boot-----------------------------

boot   spl   2,        0
       spl   2,        paper+length+aaa
       spl   1,        paper+length
       mov   -1,       0

;------paper----------------------------

       mov   <-2,      <-3

paper  spl   aaa,      length+(aaa*2)
       mov   <paper+length+aaa, <paper

       mov   <length,  <1
       spl   @0,       bbb

inner  mov   <length,  <1
       spl   @0,       ccc
       mov   1,        <eee
       mov   0,        <1
       djn   -1,       #ddd

   for 50
       dat   #0,       #0
   rof

qs    equ 322
qd    equ 161

qscan cmp 2*qs+qd       , 2*qs
qt1   jmp qa0           , <3*qs
     cmp qscan+5*qs+qd , qscan+5*qs
qt2   jmp qa1           , <4*qs
     cmp qscan+4*qs+qd , qscan+4*qs
qs1   djn qa1           , #qt1
     cmp qscan+10*qs-2 , qscan+10*qs+qd-2
qs2   djn qa2           , #qt2
     cmp qscan+9*qs+qd , qscan+9*qs
qt3   jmp qa2           , <6*qs
     cmp qscan+6*qs+qd , qscan+6*qs
     jmp qa2           , <qa1
     cmp qscan+8*qs+qd , qscan+8*qs
     jmp qa2           , <qs1
     cmp qscan+11*qs   , qscan+11*qs+qd
     jmp qa3           , <qa2
     cmp qscan+18*qs-8 , qscan+18*qs+qd-8
qs3   djn qa3           , #qt3
     cmp qscan+16*qs-2 , qscan+16*qs+qd-2
     jmp qa3           , <qs2
     cmp qscan+12*qs   , qscan+12*qs+qd
     jmp qa3           , <qa1
     cmp qscan+14*qs   , qscan+14*qs+qd
     jmp qa3           , <qs1
     jmz boot          , qscan+15*qs

qa3   add @qs3          , qp
qa2   add @qs2          , @qa3
qa1   add @qs1          , @qa3
qa0   cmp @qp           , <1234
     cmp @0            , 0
     add #qd           , qp
ql    mov qb            , @qp
qp    mov <2345         , <qscan+2*qs
     sub #9            , @ql
     djn ql            , #6
qb    jmp boot          , <43

     end qscan

