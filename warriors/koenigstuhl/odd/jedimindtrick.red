;redcode-94
;name Jedi Mind Trick
;author Ben Ford
;assert CORESIZE==8000
;strategy something along the lines of He Scans Alone
;strategy only smaller
;strategy
;strategy 200 round test ranges from 320-420
;strategy hope for results on the high end =)
; KOFACOTO-1
 
STEP equ (9)
SORG equ (2667)
SINC equ (STEP+1)
SLEN equ (send-sptr+1)
 
sptr spl #SORG, {   1
smov mov  sptr, }sptr
 jmn.f  smov, *sptr
scan add.a #SINC,  sptr
 jmz.f  scan, {sptr
 slt.ab  sptr, #SLEN
 djn.a  smov,  sptr
 djn  scan, #SLEN+3
send jmp  scan, {smov
 
end scan+1

