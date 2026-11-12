;redcode
;name Bear Dog
;author Dave Hillis
; Named after an ancient mamal that was pretty much what the name
; suggests.
;strategy - Round 4 of SPRING/SUMMER 2002 COREWAR TOURNAMENT
;strategy - pswitcher: 2 components shamelessly copied
;strategy - npaper and the dwarf from Patel's virus
;assert CORESIZE==8000

org think

; ~~~~~~~~~~~~~~~~ P-SPACE BRAIN ~~~~~~~~~~~~~~~~~~~~~
;;           
STORE equ 456 ; state storage location
w1 equ pGo  ;from nPAPERII
w0 equ dwarf    ;from Patel's Virus

think   ldp.a #0, in
    ldp.a #STORE, table
    mod.ba *in, table
    stp.b *table, #STORE
table   jmp    }0,  # 1236 ;  0: action   0 :   1   4   6
    spl #  w0,  # 1628 ;  1: action   0 :   3   4   8
    spl #  w0,  #  858 ;  2: action   0 :   0   4   3
    spl #  w1,  # 1627 ;  3: action   1 :   2   3   7
    spl #  w0,  #  676 ;  4: action   0 :   0   4   1
    spl #  w0,  #   70 ;  5: action   0 :   5   0  10
    spl #  w0,  # 1628 ;  6: action   0 :   3   4   8
    spl #  w1,  # 2257 ;  7: action   1 :   8   3   7
    spl #  w0,  #  813 ;  8: action   0 :   7   1   3
    spl #  w1,  # 2071 ;  9: action   1 :   4  13   1
    spl #  w0,  #   97 ; 10: action   0 :   6  13   7
    spl #  w0,  # 1425 ; 11: action   0 :   8  11   0
    spl #  w0,  # 1719 ; 12: action   0 :   3  11   9
    spl #  w0,  #  309 ; 13: action   0 :  10   1   9
    spl #  w1,  # 1628 ; 14: action   1 :   3   4   8

in  spl #  w0,      13 
    spl #   0,      14 
    spl #   0,      15 

; ***** DWARF *****
; from Patel's Virus

dstep equ 81
dhop equ 5277
dtime equ 1677
dbmb equ (dend+4)

dwarf mov   dend, @dptr
 mov {dwarf, <dptr
 mov {dwarf, <dptr
dptr mov   datb, *5421
 mov {dwarf, <dptr
 mov {dwarf, <dptr
djmp djn.f @ dptr,  dptr

 dat 0, 0

 spl #0, <dhop+2 ; combines with datb to form a gate
dloop mov dbmb, {(dstep*dtime)+1
 mov dbmb, @dloop ; hit by datb to start clear
 sub #dstep, dloop
dend djn.f dloop, <dhop-2
; DAT 0, 0
; DAT 0, 0
; DAT 0, 0
datb dat <dhop+1,>1

; ***** nPAPER II's paper *****

     pStep1 equ 560
     pStep2 equ 2680
     pStep3 equ -1120

     x equ -3781
     y equ -2013

pGo: spl   1,      >424
     spl   1,      {761
     spl   1,      {933
     mov   {pap1,  {pBoo
pBoo:spl   pEnd+4000,{2093
pap1:spl   @pEnd,  <pStep1
     mov.i }pap1,  >pap1
pap2:spl   @0,     {pStep2
     mov.i }pap2,  >pap2
     mov.i #1,     {1
     mov   x,      <y
     mov.i {pap2,  <pap3
pap3:jmz.a @0,     pStep3
pEnd equ pap3 + 1
end

