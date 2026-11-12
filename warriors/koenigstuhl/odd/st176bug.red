;redcode-icws
;name that strange 176-bug
;author John Metcalf
;strategy one-shot for the 11th IRC tournament
;       CORESIZE==8192
;assert 1

cptr dat #0,   #sb
gate dat #0,   #0
inc  dat #24,  #24
go   mov sptr, gate
sb   spl 0,    db-cptr
clr  mov @cptr,@gate
     add #1,   gate
     jmp clr
db   dat #0,   #db-cptr
scan add inc,  sptr
sptr cmp 124,  112
     jmp go
     jmp scan
     end sptr
