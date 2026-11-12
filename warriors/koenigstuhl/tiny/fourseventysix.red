;redcode-tiny
;name 476
;author Sascha Zapf
;strategy qbomber -> coreclear paper
;strategy 3p(c) reworked
;assert CORESIZE==800

; --- 2c qbomber ---

start   mov.i   <538, 706
        mov.i   <125, 773
        mov.i   <183, 372
        mov.i   <48 , 188
        mov.i   <443, 398
        mov.i   <569, 220
        mov.i   <534, 329
        mov.i   <336, 523
        mov.i   <97 , 249

; --- create 6 parallel processes        
        
pgo     spl     2   , <318
        spl     1   , <513
        spl     1   , <466

; --- boot and decoy constants

pAw1    equ     97
pAw2    equ     490
pEnd    equ     cc+1
    
; --- boot away and start ---        
        
        mov     {cp         , {pBo1
pBo1    djn.f   pEnd+pAw1   , <pAw2

; --- constants for the coreclear paper ---

nstep1  equ     125
tstep1  equ     438
cstep2  equ     478

; --- silk's body ---

cp      spl     @pEnd   , <tstep1
        mov.i   }cp     , >cp
nothB   spl     @nothB  , <nstep1
        mov.i   }nothB  , >nothB
        mov.i   #1      , <1
cc      djn.b   -2      , #cstep2

        end     start

