;redcode-94
;name Splitter
;author Ben Ford
;strategy 1. precision scan for CIA
;strategy    - CIA doesn't have any 0 b-fields and Jedimp does
;strategy    - CIA has a pair of -16 b-fields in boot code
;strategy 2. split miniblur
;strategy    - Jedimp has all but one non-0 a-fields
;strategy    - maximize my own 0 a-fields to speed scan and up # of scans
;strategy    - I handle the scanning
;strategy    - captured CIA handles the blurring
;strategy 3. d-clear
;strategy    - runs effectively at 2c due to me + CIA
;assert 1
; KOFACOTO 4
 
start equ hunt+1
next equ sadd+1
forg equ sptr
 
fang jmp @   0,  trap-hunt
 
; split miniblur
 
sinc equ 1169
sclk equ 3715
slen equ (cbmb-sptr+2)
cptr equ (sptr-2)
clen equ (cbmb-cptr+2)
 
sptr nop #   0, #2505
sadd sub #sinc, #sinc*sclk
 jmz.a @   0, @sadd
 mov.b  sadd,  sptr
 jmn @   0,  sadd
trap mov  sbmb, >sptr
 jmn  trap,  sadd
sbmb spl $   0, $   0
cmov mov  cbmb, >cptr
 djn.f  cmov, >cptr
cbmb dat $   0,  clen
 
for 70
 spl $   0, $   0
rof
 
; find and trap CIA
 
mbmb mov.i #   0, <   0
hunt add.ab # -83, #forg-183 ; -83 conviently points to fang
 jmz.b @   0, @hunt ; just scanning b-fields ignores imps
find seq.b <hunt, # -16 ; look for the pair of -16's in b-field
 jmn.b  find, <hunt
 seq.b @hunt, # -16 ; find -16 or false alarm?
 jmp @   0, <hunt
 add.ab #2505,  hunt ; position to the booted code
 sub.b @   0, *hunt ; point the fang
 mov.i  fang, @hunt ; drop the fang
 mov.i  mbmb, <hunt ; and clear out the spl
 jmp @   0, $next
 
for MAXLENGTH-CURLINE
 spl $   0, $   0
rof
 
end start
