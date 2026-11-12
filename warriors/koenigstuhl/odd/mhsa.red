;redcode-94
;name mHSA
;author Christian Schmidt
;strategy mini-HAS from Electric Head
;strategy slightly optimized for RotJ
;assert 1
; KOFACOTO-1

step EQU 8
count equ 17
ptr EQU (bomb-5)
tDecoy    equ    (bomb-1196-6)

bomb: spl    #1,{1
kill: mov    bomb,<ptr
mptr: mov    >ptr,>ptr
      jmn.f  kill,>ptr
a:    add    #step+1,@mptr
scan: jmz.f  a,<ptr
      slt    @mptr,#btm-ptr+3
      djn    kill,@mptr
      djn    a,#count
btm:  jmp    a,{kill


      for 61
          dat 0,0
      rof

tStart    mov    <tDecoy+0,{tDecoy+2
          mov    <tDecoy+3,{tDecoy+5
          mov    <tDecoy+6,{tDecoy+8
          djn.f   scan+1  ,<tDecoy+10

end tStart

