;redcode-94x
;name Quick Coding!
;author John Metcalf
;strategy Spiral for IRCT07
;assert 1
; CORESIZE==800

      add.a #6,    sp1   ; setup :-)
      mov   sp1,   sp2
      mov   sp1,   sp3
      mov   sp1,   sp4
      mov   sp1,   }sp4
      add.a #5,    sp5

sp1:  spl   -5,    0     ; spl 1
sp2:  dat   0,     0     ; spl 1
sp3:  dat   0,     0     ; spl 1
sp4:  dat   0,     0     ; spl 2
sp5:  dat   0,     0     ; spl imp
      add.a #267,  sp5
      dat   0,     0
      dat   0,     0
      dat   0,     0
      dat   0,     0
imp:  mov.i #267,  *0
      end


