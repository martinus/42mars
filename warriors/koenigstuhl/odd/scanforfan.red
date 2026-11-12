;redcode-88
;name Scan for Fan
;author LAchi
;assert 1

FT equ start - MINDISTANCE

;here I will cmp the stolen instr with the expected code
cmp1  dat #0    , #0
cmp3  djn  0    , #-1

; [START]
;fast sequential c scan

start cmp <ptr  , <ptr
rst1  jmp  locat
      jmp  start
ptr   dat #FT   , #FT

;I will vamp the flag with an imp

imp   mov  0    ,  1

; [CHECK]
;here I will steal the instr to see if I found the flag
; 2 steps, starting from locat
; first I copy a 0 in the b-field
; when I steal the instr the flag had decremented by 1

back  mov #0    , <ptr
      mov @ptr  ,  cmp1
      cmp  cmp3 ,  cmp1
      jmp  clr
      jmp  gotit
locat add #2    ,  ptr
      mov #0    , <ptr
      mov @ptr  ,  cmp1
      cmp  cmp3 ,  cmp1
      jmp  back

; [FOUND THE FLAG]
;I vamp the flag with an imp, waiting to be reached

gotit mov  imp  , @ptr
      mov  rst  ,  rst1
      jmp  start

; if I found the flag, I will skip the check

rst   jmp  dclr-rst1

; [CLEAR]
; if I found the flag, I will not self-check
; and become myself an imp

dclr  slt #25   ,  ptr
      jmp  imp

; 5 clear steps

clr   add #2    ,  ptr
      mov  ptr  , <ptr
      mov  ptr  , <ptr
      mov  ptr  , <ptr
      mov  ptr  , <ptr
      mov  ptr  , <ptr
      jmp  start

datz
      end start
