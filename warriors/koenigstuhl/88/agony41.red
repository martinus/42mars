;redcode
;name Agony 4.1
;author Stefan Strack
;strategy Small-interval CMP scanner that bombs with a SPL 0 carpet.
;strategy 2.0: smaller
;strategy 2.1: larger, but should tie less; changed scan constants
;strategy 2.2a: smaller
;strategy 2.3a: mutagenizes core
;strategy 2.4: smaller CMP interval, spends less time bombing
;strategy 2.4b: mutagenize constant optimized
;strategy 3.0: long scan with anti-imp constants (a la Charon v8.0+)
;strategy 3.1: zero bfield bombs again; more robust
;strategy 4.0: gating; shorter carpet
;strategy 4.1: tweaked constants
;strategy Submitted: Thu Mar 11 20:48:51 CST 1993
;assert CORESIZE==8000

CDIST   equ 10
IVAL    equ 68 ;22 ;22 ;42
FIRST   equ scan+OFFSET+IVAL
OFFSET  equ 72 ;(3010*IVAL)   ;2983
DJNOFF  equ 3641 ;7645 ;7691
load    mov #CDIST+(bptr-comp)+1,count
scan    sub incr,comp
comp    cmp FIRST-CDIST,FIRST
        slt #incr-comp+CDIST+(bptr-comp)+1,comp
        djn scan,<FIRST+DJNOFF
        mov comp,bptr
bptr    dat #0
split   mov bomb,<bptr
count   djn split,#CDIST+(bptr-comp)+1
        jmz load,load-1
bomb    spl 0,<1-IVAL
        mov incr,<count
incr    dat <0-IVAL,<0-IVAL
        end comp

