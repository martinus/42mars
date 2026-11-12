;redcode-tiny
;name Paper Sibling
;author Philipp Schaefer
;strategy qbomb -> Paper
;strategy slight changes, optimaxed
;assert 1

;; --------
;; STARTPOS
;; --------
        org     qbomb

;; ---------
;; Quickbomb
;; ---------

;; QB Constants
dlength equ     293
dcount  equ     9
dstep   equ     (dlength/dcount)
dstart  equ     (silk - 10 - dlength - i)

;; QB Code (dcount Instructions)
qbomb

i       for     dcount
        mov     }(dstart+(dcount-i+1)*dstep)+1, (dstart-(dcount-i+1)*dstep)
rof

;; ----
;; Silk
;; ----

;; Start Constants
sB1     equ     231
sB2     equ     762

;; Start Code (3 Instructions)
silk    spl     1,      }sB1
        mov     -1,     0
        spl     1,      }sB2

;; Boot Constants
bAway   equ     146

;; Boot Code (2 Instructions)
boot    mov     <1,     {1
        jmp     bAway,  silk2+1

;; Paper constants
pA1     equ     424
pA2     equ     25
pB1     equ     290
pB2     equ     180
pB3     equ     671
pB4     equ     776
pDjnPos equ     289

;; Paper Code (6 Instructions)
silk1   spl     pA1,     0
        mov     >silk1,  }silk1
        mov     <silk1,  {silk2
        mov     }pB1,    {pB2
        mov     }pB3,    {pB4
silk2   djn.f   pA2,     <pDjnPos

