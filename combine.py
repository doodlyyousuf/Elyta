import os

def combine_files(src_dir, output_file):
    exclude_dirs = {'node_modules', '.git', 'public', '.env'}
    exclude_exts = {'.jpg', '.png', '.ico', '.json', '.lock'}
    
    with open(output_file, 'w', encoding='utf-8') as out_f:
        for root, dirs, files in os.walk(src_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                if any(file.endswith(ext) for ext in exclude_exts):
                    continue
                if file == 'combined_code.txt' or file == 'combine.py':
                    continue
                
                file_path = os.path.join(root, file)
                out_f.write(f"\n\n--- FILE: {file_path} ---\n\n")
                try:
                    with open(file_path, 'r', encoding='utf-8') as in_f:
                        out_f.write(in_f.read())
                except Exception as e:
                    out_f.write(f"<Error reading file: {e}>\n")

if __name__ == '__main__':
    workspace = r'c:\Users\Doodlyyousuf\Documents\Projs\cus_dis_bot'
    output = os.path.join(workspace, 'combined_code.txt')
    combine_files(workspace, output)
    print(f"Successfully combined files into {output}")
