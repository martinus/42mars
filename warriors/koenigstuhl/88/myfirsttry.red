;redcode
;name My 1st try
;author Christian Schmidt
;strategy qscan -> stone
;assert 1

step  equ  3359
delay equ  1505
time2 equ  2478
time3 equ   961
time4 equ  1359
dist  equ  -612
dc    equ   181
dw    equ    10
dp    equ    13
db    equ     5
gate  equ    -5
time  equ    59

decoy dat #0, #0

stone spl 0, step+1
     sub 3, 1
     dat #decoy, #1
     mov < time2*(-3), < 1+(delay*step*2)
     mov -3, @-1
     jmp -3, < step*2

clear mov      db, < dp
     dat  #decoy, # 1
     jmp      -1, < -12
     jmp   -2+dw,   0

cb    dat  < 2667, # -dp
wimp  jmp       0, < gate
back  mov       1, < -9
bust  dat  < 2663, < 2663
bust2 dat  < 2663, # 1

start mov stone+5,   boot+dist+4
     mov stone+4, < -1
     mov stone+3, < -2
     mov stone+1, < -3
     mov      cb,   boot+dist+dc+db
     mov stone+0, < -5
hide  mov clear+3,   boot+dist+dc+2
     mov clear+2, < -1
     mov clear+0, < -2
     mov    wimp,   boot+dist+dc+dw
     mov    back,   boot+dist+1+((time2-delay-time3)*(-3))
     mov    bust, < -2 ;boot+dist+dc+dw+gate+4
     mov #time-dp-dc, boot+dist+dc+dp
     mov   bust2,   boot+dist+2+((time2-time4)*(-3))
     mov #time-dp-dc, < -2
boot  spl    dist, < start
cboot jmp boot+dist+dc, < hide


qs    equ 322
qd    equ 161

qscan cmp 2*qs+qd       , 2*qs
qt1   jmp qa0           , <3*qs
     cmp qscan+5*qs+qd , qscan+5*qs
qt2   jmp qa1           , <4*qs
     cmp qscan+4*qs+qd , qscan+4*qs
qs1   djn qa1           , #qt1
     cmp qscan+10*qs-2 , qscan+10*qs+qd-2  ; qscan-(qt2-1) = -2
qs2   djn qa2           , #qt2
     cmp qscan+9*qs+qd , qscan+9*qs
qt3   jmp qa2           , <6*qs
     cmp qscan+6*qs+qd , qscan+6*qs
     jmp qa2           , <qa1
     cmp qscan+8*qs+qd , qscan+8*qs
     jmp qa2           , <qs1
     cmp qscan+11*qs   , qscan+11*qs+qd
     jmp qa3           , <qa2
     cmp qscan+18*qs-8 , qscan+18*qs+qd-8  ; qscan-(qt3-1) = -8
qs3   djn qa3           , #qt3
     cmp qscan+16*qs-2 , qscan+16*qs+qd-2  ; qscan-(qt2-1) = -2
     jmp qa3           , <qs2
     cmp qscan+12*qs   , qscan+12*qs+qd
     jmp qa3           , <qa1
     cmp qscan+14*qs   , qscan+14*qs+qd
     jmp qa3           , <qs1
     jmz start          , qscan+15*qs

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
qb    jmp start          , <43

     end qscan


