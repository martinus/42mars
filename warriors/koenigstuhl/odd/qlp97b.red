;redcode-94nop
;assert 1
;name QLP-97b
;author Lukasz Grabun

step equ 1997
ptr  equ (top-3)

top
wipe mov.i  ptr  ,@ptr
scan add.ab #step ,ptr
     jmz.f  scan  ,@ptr
     slt.b  ptr   ,#tail-top+3
     jmp    wipe  ,0
     jmp    scan  ,0
bomb 
tail dat.f  0     ,0
end scan