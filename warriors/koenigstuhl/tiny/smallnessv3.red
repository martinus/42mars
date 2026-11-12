;redcode-tiny
;name Smallness (v3)
;author Philipp Schaefer
;strategy qbomb -> sd clear
;strategy v2: changed bombing addressing modes
;strategy v3: added boot, small tweaks, optimaxed
;assert 1

;; --------
;; STARTPOS
;; --------
        org     decoy

;; ----
;; Boot
;; ----

;; Boot Constants
bootp   equ     540

;; Boot Code
boot    mov     <3,             {3
        djn     -1,             #6
        djn     bootp-4,        {228
        dat     bootp,          e+1

;; -----
;; Clear
;; -----


;; Clear Constants
csize   equ     (e-cp+1)

;; Clear Code
cp      dat     clear,          29 ;dend+20
clear   spl     #csize-1,       csize
        mov     *cp,            >cp
        mov     *cp,            >cp
        djn.f   clear+1,        <773
e       dat     csize-1,        csize

;; ---------
;; Quickbomb
;; ---------

;; QB Constants
dlength equ     344
dcount  equ     9
dstep   equ     (dlength/dcount)
dstart  equ     (cp - 10 - dlength - i)
fill    equ     (9 - dcount)

for     fill
        dat     0,              0
rof

;; QB Code (dcount Instructions)
decoy   

i       for     dcount
        mov     }(dstart+(dcount-i+1)*dstep)+1, (dstart-(dcount-i+1)*dstep)
rof
dend    djn.f   boot,                           {548
